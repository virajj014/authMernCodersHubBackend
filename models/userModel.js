const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// hj123  -> fsdhshsdgadgd


const userSchema = new mongoose.Schema({
    name: { required: true, type: String },
    email: { required: true, type: String },
    password: { required: true, type: String },
    profilePic: { type: String},
}, { timestamps: true })


userSchema.pre('save', async function (next){
    const user = this;
    if(user.isModified('password')){
        user.password = await bcrypt.hash(user.password, 10)
    }
    next();
})

module.exports = mongoose.model('User', userSchema)