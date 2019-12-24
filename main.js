const morgan = require('morgan');
const mysql = require('mysql');
const express = require('express');
const hbs = require('express-handlebars');
const otplib = require('otplib');

// const config = require('./config');
// const mkQuery = require('./dbutil');
const db = require('./dbutil');
const config = require('./config(full)');
const { loadConfig, testConnections } = require('./initdb')
const conns = loadConfig(config);

const PORT = 3000;
// const pool = mysql.createPool(config);

const INSERT_USER = 'insert into user(username, password, email, department, gSecret) values (?, ?, ?, ?, ?)';
const FIND_USER = 'select count(*) as user_count from users where username = ? and password = sha2(?, 256)';
const GET_USER_DETAILS = 'select username, email, department from users where username = ?';

const insertUser = db.mkQueryFromPool(db.mkQuery(INSERT_USER), conns.mysql);
const findUser = db.mkQueryFromPool(db.mkQuery(FIND_USER), conns.mysql);
const getUserDetails = db.mkQueryFromPool(db.mkQuery(GET_USER_DETAILS), conns.mysql);
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
                const gSecret = 'JBBECWCTK5JUSTK2JVME2TSEJZGUMNKIIFLVIUCJGVLFQRJWKRJQ';
                const code = otplib.authenticator.generate(gSecret);
                console.info('code: ', code)
                if (req.body.challenge != code)
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

app.get(['/', '/register'], (req, resp) => {
    console.info('register: session', req.session);
    resp.status(200).type('text/html')
    resp.render('index', { 
        showChallenge: req.session.loginError >= 3
    })
});

app.post(['/', '/register'], (req, resp) => {
    console.info('req.body: ', req.body);
        
        conns.mysql.getConnection(
            (err, conn) => {
                if (err){
                    return resp.status(500).type('text/plain').send(`Error ${err}`);
                }
                
                db.startTransaction(conn)
                .then (
                    //insert into MySQL DB
                    status => {
                        const art_id = uuid().substring(0,8);
                        const postDate = new Date();
                        const params = [
                            art_id, 
                            req.body.title, 
                            req.body.email, 
                            req.body.article,
                            postDate,
                            req.file.filename  // as text
                        ]
                        return (insertNewArticle({connection:status.connection, params: params}));
                    }
                )
                .then(db.passthru, db.logError)
                .then(status => 
                    new Promise(
                        (resolve, reject) => {
                            fs.readFile(req.file.path,(err, imgFile) => {
                                if (err)
                                    return reject({connection: status.connection, error: err})
                                const params = {
                                    Bucket: 'belloz', Key: `articles/${req.file.filename}`,  // post photo on DO spaces 
                                    Body: imgFile, ContentType: req.file.mimetype,
                                    ContentLength:  req.file.size, ACL: 'public-read'
                                }
                                conns.s3.putObject(params, 
                                    (error, result) => {
                                        if (error)
                                            return reject({ connection: status.connection, error })
                                        resolve({ connection: status.connection, result })
                                    }
                                )
                            })
                        }
                    )
                )
                .then(db.commit, db.rollback) // success, fail (or .catch)
                .then(
                    (status)=>{
                        return new Promise(
                            (resolve, reject) =>{
                                fs.unlink(req.file.path, () =>{
                                    resp.status(201).type('text/plain').send(`Posted article: ${req.body.title}`);
                                    resolve;
                                })
                            }
                        )
                    },
                    (status)=>{
                        resp.status(400).type('text/plain').send(`Error ${status.error}`);
                    }
                )
                .finally(()=>conn.release);
            }
        )
    }
)

app.get('/login', (req, resp) => {
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
        failureRedirect: '/login'
    }),
    (req, resp) => {
        console.info('req.session: ', req.session)
        resp.status(200).type('text/html').send('You have login');
    }
)

app.use(express.static(__dirname + '/public'))

testConnections(conns)
	.then(() => {
		app.listen(PORT,
			() => {
				console.info(`Application started on port ${PORT} at ${new Date()}`);
			}
		)
	})
	.catch(error => {
		console.error(error);
		process.exit(-1);
    })
    
// app.listen(PORT,
//     () => { console.info(`Application started on port ${PORT} at ${new Date()}`) }
// );



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