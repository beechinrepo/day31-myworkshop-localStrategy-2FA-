const otplib = require('otplib');
const qrcode = require('qrcode');

const gSecret = 'JBBECWCTK5JUSTK2JVME2TSEJZGUMNKIIFLVIUCJGVLFQRJWKRJQ';
const user = 'barney@gmail.com';
const app = 'my2ndapp'

const otpauth = otplib.authenticator.keyuri(user, app, gSecret)
console.info('otpauth: ', otpauth)

qrcode.toDataURL(otpauth, 
    (error, imgData) => {
        console.info('error: ', error);
        console.info('imgData: ', imgData);
    }
)  
// run all 3 steps
// qrcode to add this app to google authenticator on phone
// open qrcode (index.html) from folder