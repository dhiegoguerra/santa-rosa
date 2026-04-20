const { spawn } = require('child_process');

const children = [];

function pipeOutput(stream, prefix, target) {
    let buffer = '';

    stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (line.trim().length > 0) {
                target.write(`[${prefix}] ${line}\n`);
            }
        }
    });

    stream.on('end', () => {
        if (buffer.trim().length > 0) {
            target.write(`[${prefix}] ${buffer}\n`);
        }
    });
}

function runScript(scriptName, prefix) {
    const child = spawn('npm', ['run', scriptName], {
        cwd: process.cwd(),
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe']
    });

    pipeOutput(child.stdout, prefix, process.stdout);
    pipeOutput(child.stderr, prefix, process.stderr);

    child.on('exit', (code) => {
        if (code !== 0) {
            process.stderr.write(`[${prefix}] processo finalizado com código ${code}\n`);
            shutdown(code || 1);
        }
    });

    children.push(child);
}

let isShuttingDown = false;

function shutdown(exitCode = 0) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    for (const child of children) {
        if (!child.killed) {
            child.kill();
        }
    }

    setTimeout(() => process.exit(exitCode), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

runScript('start:api', 'api');
runScript('dev', 'front');
