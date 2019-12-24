const morgan = require('morgan');
const mysql = require('mysql');
const express = require('express');
const hbs = require('express-handlebars');

const config = require('./config');
const mkQuery = require('./dbutil');

const PORT = 3000;
const pool = mysql.createPool(config);

const FIND_USER = 'select count(*) as user_count from users where username = ? and password = sha2(?, 256)';
const GET_USER_DETAILS = 'select username, email, department from users where username = ?';

const findUser = mkQuery(FIND_USER, pool);
const getUserDetails = mkQuery(GET_USER_DETAILS, pool);
const authenticateUser = (param) => {
    return (
        findUser(param)
            .then(result => (result.length && result[0].user_count > 0))
    )
}

// Load Libraries (passport n passport-local, express-session)
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

//Configure passport to use PassportLocal
passport.use(
    new LocalStrategy(
        {
            usernameField: 'username',
            passwordField: 'password',
            passReqToCallback: true
        },
        (req, username, password, done) => {
            if (req.session.loginError && req.session.loginError >= 3) {
                if (req.body.challenge != 'abc123')
                    return done(null, false);
            }
            authenticateUser([ username, password ])
                .then(result => {
                    if (result)
                        return done(null, username);
                    // Check if loginError attribute is in the session
                    req.session.errorMessage = 'Incorrect login'
                    if (req.session.loginError)
                        req.session.loginError++;
                    else
                        // if it is not, initialize it to 1
                        req.session.loginError = 1;
                    console.info('loginError: ', req.session.loginError)
                    done(null, false);
                })
        }
    )
)
passport.serializeUser(
    (user, done) => {
        console.info('serialized: ', user);
        done(null, user);
    }
)
passport.deserializeUser(
    (user, done) => {
        getUserDetails([ user ])
            .then(result => {
                done(null, { ...result[0] })
            })
            .catch(error => {
                console.error('>> deserialize error: ', error)
                done(null, false);
            })
    }
)

const app = express();

app.engine('hbs', hbs({ defaultLayout: 'main.hbs'}))
app.set('view engine', 'hbs');

app.use(morgan('tiny'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: config.sessionSecret,
    name: 'session_id',
    resave: true,
    saveUninitialized: true
}))

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.get('/protected/secret',
    (req, resp, next) => {
        if (req.user)
            return next();
        resp.redirect('/');
    },
    (req, resp) => {
        console.info('user: ', req.user)
        console.info('req.session: ', req.session)
        resp.status(200).type('text/html').send(`The time is ${new Date()}`)
    }
)

app.get(['/', '/login'], (req, resp) => {
    console.info('login: session', req.session);
    resp.status(200).type('text/html')
    resp.render('index', { 
        showChallenge: req.session.loginError >= 3
    })
});

app.get('/logout', 
    (req, resp) => {
        if (!req.session)
            return resp.redirect('/');
        req.session.destroy(err => {
            resp.redirect('/');
        })
    }
)

app.post('/authenticate',
    passport.authenticate('local', { 
        failureRedirect: '/'
    }),
    (req, resp) => {
        console.info('req.session: ', req.session)
        resp.status(200).type('text/html').send('You have login');
    }
)

app.use(express.static(__dirname + '/public'))

app.listen(PORT,
    () => { console.info(`Application started on port ${PORT} at ${new Date()}`) }
);



// app.get('/protected/secret',
//     (req, resp) => {
//         if (req.user)
//             return next();
//         resp.redirect('/');
//     },
//     (req, resp) => {
//         return resp.status(200).type('text/html').send(`The time is ${new Date()}`);
//         // console.info('user: ', req.user);
//         // console.info('req.session: ', req.session);
//         // req.session.count++;  
//     }
// )