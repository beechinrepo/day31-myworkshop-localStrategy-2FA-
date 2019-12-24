const otplib = require('otplib');

const gSecret = 'JBBECWCTK5JUSTK2JVME2TSEJZGUMNKIIFLVIUCJGVLFQRJWKRJQ';

const code = otplib.authenticator.generate(gSecret);

console.info('code = ', code);  // 6 digit code