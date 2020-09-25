// Some old school imports to support Node 12
// in the Github Actions runner
const ngrok = require('ngrok');
const express = require('express');
const bodyParser = require('body-parser');
const chalk = require('chalk');
const cp = require('child_process');
const core = require('@actions/core');

console.log(chalk.redBright('Hello from expo-apple-2fa!'));

let expoCli = undefined;
let expoOut = '';

function log(buffer) {
    console.log(buffer);
}

// First, start our web server...
const api = express();
api.use(bodyParser.json());

// Handle our routes...
api.get('/', (req, res) => {
    // TODO: make a web interface.
    res.send(`Hello world!\r\n<pre>${expoOut}</pre>`);
});

api.post('/', (req, res) => {
    try {
        const { code } = req.body;
        if (code) {
            res.status(204).send();
            expoCli.stdin.write(code + '\n');
        }
        else {
            res.status(400).send({'error': 'No code provided.'});
        }
    }
    catch (exc) {
        console.error(exc);
        res.status(500).send(exc);
    }
});

// Start our API server and ngrok.
// Once we do that, we need to start the publishing process
api.listen(9090, async () => {
    const url = await ngrok.connect(9090);
    
    log(chalk.greenBright( '===> When you receive your two factor auth code, visit:'));
    log(chalk.whiteBright(`     ${url}`));
    log('');

    // Start work on our Expo project.
    const expoArguments = core.getInput('expo_arguments');
    console.log(chalk.blueBright(`===> Running: expo upload:ios ${expoArguments}`));

    expoCli = cp.spawn('script', ['-r', '-q', '/dev/null', `expo upload:ios ${expoArguments}`], {
        env: {
            ...process.env,
            EXPO_APPLE_PASSWORD: core.getInput('expo_apple_password'),
            SPACESHIP_2FA_SMS_DEFAULT_PHONE_NUMBER: core.getInput('tfa_phone_number'),
        },
        shell: 'zsh',
    });

    console.log(`pid: ${expoCli.pid}`);

    // Basic piping experiment
    expoCli.stdout.pipe(process.stdout, { end: false });
    expoCli.stderr.pipe(process.stdout, { end: false });

    expoCli.stdout.on('data', function(data) {
        expoOut += data.toString();
    });
    expoCli.stderr.on('data', function(data) {
        expoOut += data.toString();
    });

    const onExit = (code) => {
        console.log('===> Expo-cli exited with code', code);
        process.exit(code);
    }
    expoCli.on('exit', onExit);
    expoCli.on('close', onExit);
});
