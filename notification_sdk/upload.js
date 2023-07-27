const { NosClient } = require('@xgheaven/nos-node-sdk');
const fs = require('fs');
const path = require('path');
const args = require('minimist')(process.argv.slice(2));
const pkg = require('./package.json');
const client = new NosClient({
    accessKey: '46535ad9ad4d486ebc601a4750d5576f',
    accessSecret: '5b497765931f4fc2b2c0ca3f128990f4',
    endpoint: 'http://nos-eastchina1.126.net', // endpoint，不同地域不同
    defaultBucket: args.bucket || 'lcap-deploy-test', // 默认的 Bucket，如果不设置，那么需要在单独的每次请求中进行设置
});
const version = pkg.version;

const dirs = ['dist-theme'];

// check build files
const existDirs = dirs.filter((dir) => !fs.existsSync(dir));
if (existDirs.length) {
    existDirs.forEach((dir) => {
        console.error(`upload.js ===========> error: lose ${dir}, you may forget build ${dir}!`);
    });
    return;
}

dirs.forEach((dir) => {
    listFile(dir, dir);
});

function listFile(dir, root) {
    const arr = fs.readdirSync(dir);
    arr.forEach((item) => {
        const fullpath = path.posix.join(dir, item);
        const stats = fs.statSync(fullpath);
        if (stats.isDirectory()) {
            listFile(fullpath, root);
        } else {
            if (fullpath.includes('.DS_Store'))
                return;
            const fileinfo = fs.readFileSync(path.posix.join(process.cwd(), fullpath));
            const objectKey = `packages/${pkg.name}@${version}/${fullpath}`;
            console.log(`NosClient: putObject start --------> ${objectKey}`);
            client.putObject({
                objectKey,
                body: Buffer.from(fileinfo), // 支持 Buffer/Readable/string
            }).then(() => {
                console.log(`NosClient: putObject end --------> ${objectKey} success!`);
            }).catch((err) => {
                console.log(`NosClient: putObject end --------> ${objectKey} err:`, err);
            });
        }
    });
}