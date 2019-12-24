/*
    const getGames = mkQuery('select * from game', pool);
    const getCommentsByGid = mkQuery('select * from comment where gid = ?', pool);

    getGames() //-> Promise<Game[]>
        .then(result => { })
        .error(error => { })

    getCommentsByGid([ 123 ]) //-> Promise<Game[]>
        .then(result => { })
        .error(error => { })
*/

const mkQuery = function(sql, pool) {
    const f = function(params) {
        const p = new Promise(
            (resolve, reject) => {
                pool.getConnection(
                    (err, conn) => {
                        if (err)
                            return reject(err);
                        conn.query(sql, params || [],
                            (err, result) => {
                                conn.release();
                                if (err)
                                    return reject(err);
                                resolve(result);
                            }
                        )
                    }
                )
            }
        )
        return (p);
    }
    return (f);
}

module.exports = mkQuery;