const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', 'vendor');
const destination = path.resolve(__dirname, '..', 'public', 'vendor');

fs.mkdirSync(path.join(destination, 'core'), { recursive: true });
fs.mkdirSync(path.join(destination, 'lang'), { recursive: true });
fs.copyFileSync(path.join(source, 'worker.min.js'), path.join(destination, 'worker.min.js'));
fs.cpSync(path.join(source, 'core'), path.join(destination, 'core'), { recursive: true });
fs.copyFileSync(
  path.join(source, 'lang', 'eng.traineddata.gz'),
  path.join(destination, 'lang', 'eng.traineddata.gz')
);
