const {createHash}=require('node:crypto');
/** E oracle hashes the original Match route output, independently of replay/digest implementation. */
exports.trajectoryHash=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
