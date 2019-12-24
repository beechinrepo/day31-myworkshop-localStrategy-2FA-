// const aws = require('aws-sdk');
const mysql = require('mysql');
// const MongoClient = require('mongodb').MongoClient;

const loadConfig = (config) => {
	return {
		mysql: mysql.createPool(config.mysql)
		// s3: new aws.S3({
		// 	endpoint: new aws.Endpoint('sgp1.digitaloceanspaces.com'),
		// 	accessKeyId: config.s3.accessKey,
		// 	secretAccessKey: config.s3.secret
		// }),
		// mongodb: new MongoClient(config.mongodb.url, { useUnifiedTopology: true })
	}
};

const testConnections = (conns) => {
	const p = [];
	p.push(new Promise(
		(resolve, reject) => {
			conns.mysql.getConnection(
				(err, conn) => {
					if (err)
						return reject(err);
					conn.ping(err => {
						conn.release();
						if (err)
							return reject(err);
						console.info('resolved mysql');
						resolve();
					})
				}
			)
		}
	));

	// p.push(new Promise(
	// 	(resolve, reject) => {
	// 		conns.mongodb.connect(
	// 			err => {
	// 				if (err)
	// 					return reject(err);
	// 				console.info('resolved mongodb');
	// 				resolve();
	// 			}
	// 		)
	// 	}
	// ))

	// p.push(new Promise(
	// 	(resolve, reject) => {
	// 		const params = {
	// 			Bucket: 'abc123',
	// 			Key: 'dice.png'
	// 		}
	// 		conns.s3.getObject(params,
	// 			(err, result) => {
	// 				if (err)
	// 					return reject(err);
	// 				console.info('resolved s3');
	// 				resolve();
	// 			}
	// 		)
	// 	}
	// ))

	// p.push(new Promise(
	// 	(resolve, reject) => {
	// 		const params = {
	// 			Bucket: 'belloz',
	// 			Key: 'Hello-kitty.jpg'
	// 		}
	// 		conns.s3.getObject(params,
	// 			(err, result) => {
	// 				if (err)
	// 					return reject(err);
	// 				console.info('resolved s3');
	// 				resolve();
	// 			}
	// 		)
	// 	}
	// ))

	return (Promise.all(p))
}

module.exports = { loadConfig, testConnections };
