const otplib = require('otplib');

const secret = otplib.authenticator.generateSecret();
const gSecret = otplib.authenticator.encode(secret);

console.info('> secret: ', secret)
console.info('> gSecret: ', gSecret)