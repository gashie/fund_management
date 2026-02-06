

let {actCode} = require('../../config/actcodes');


async function findActCode(code) {
    return actCode.find(item => item.code === code);
}



module.exports = { findActCode };
