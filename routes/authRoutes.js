const express = require('express');
const User = require('../models/userModel')
const Verification = require('../models/verificationModel');
const responseFunction = require('../utils/responseFunction');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authTokenHandler = require('../middlewares/checkAuthToken');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY

    }
})


const mailer = async (recieveremail, code) => {
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        post: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: process.env.COMPANY_EMAIL,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    })


    let info = await transporter.sendMail({
        from: "Team BitShare",
        to: recieveremail,
        subject: "OTP for BitShare",
        text: "Your OTP is " + code,
        html: "<b>Your OTP is " + code + "</b>",

    })

    console.log("Message sent: %s", info.messageId);

    if (info.messageId) {
        return true;
    }
    return false;
}


router.get('/', (req, res) => {
    res.json({
        message: 'Auth route home'
    })
})
router.post('/sendotp', async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return responseFunction(res, 400, "Email is required", null, false)
    }
    try {
        await Verification.deleteMany({ email: email })
        const code = Math.floor(100000 + Math.random() * 900000);

        const isSent = await mailer(email, code);


        const newVerification = new Verification({
            email: email,
            code: code
        })

        await newVerification.save();

        if (!isSent) {
            return responseFunction(res, 500, "Internal server error", null, false)
        }

        return responseFunction(res, 200, "OTP sent successfully", null, true)
    }
    catch (err) {
        return responseFunction(res, 500, "Internal server error", err, false)
    }
    // res.json({
    //     data: email
    // })
})



router.post('/register', async (req, res, next) => {
    const { name, email, password, otp, profilePic } = req.body;

    if (!name || !email || !password || !otp) {
        return responseFunction(res, 400, 'All fields are required', null, false);
    }

    if (password.length < 6) {
        return responseFunction(res, 400, 'Password should be atleast 6 characters long', null, false);
    }

    let user = await User.findOne({ email: email })

    let verificationQueue = await Verification.findOne({ email: email })

    if (user) {
        return responseFunction(res, 400, 'User already exists', null, false);
    }
    if (!verificationQueue) {

        return responseFunction(res, 400, 'Please send otp first', null, false);
    }

    const isMatch = await bcrypt.compare(otp, verificationQueue.code);
    if (!isMatch) {
        return responseFunction(res, 400, 'Invalid OTP', null, false);
    }


    user = new User({
        name: name,
        email: email,
        password: password,
        profilePic: profilePic
    })

    await user.save();
    await Verification.deleteOne({ email: email });
    return responseFunction(res, 200, 'registered successfully', null, true);

})

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return responseFunction(res, 400, 'Invalid credentials', null, false);
        }
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {

            return responseFunction(res, 400, 'Invalid credentials', null, false);
        }


        const authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '1d' })
        const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET_KEY, { expiresIn: '10d' })

        user.password = undefined;

        res.cookie('authToken', authToken, { httpOnly: true, secure: true, sameSite: 'none' })
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'none' })

        return responseFunction(res, 200, 'Logged in successfully', { user, authToken, refreshToken }, true);
    }
    catch (err) {
        return responseFunction(res, 500, 'Internal server error', err, false);
    }
})

router.post('/changepassword', async (req, res, next) => {
    try {
        const { email, otp, password } = req.body;

        if (!email || !otp || !password) {
            return responseFunction(res, 400, 'All fields are required', null, false);
        }

        let user = await User.findOne({ email: email });
        let verificationQueue = await Verification.findOne({ email: email });
        if (!user) {
            return responseFunction(res, 400, "User doesn't  exist", null, false);
        }
        if (!verificationQueue) {

            return responseFunction(res, 400, 'Please send otp first', null, false);
        }
        const isMatch = await bcrypt.compare(otp, verificationQueue.code);
        user.password = password;
        await user.save();
        await Verification.deleteOne({ email: email });
        return responseFunction(res, 200, 'Password changed successfully', null, true);

    }
    catch (err) {
        return responseFunction(res, 500, 'Internal server error', err, false);
    }
});

router.get('/checklogin', authTokenHandler, async (req, res, next) => {
    res.json({
        ok: req.ok,
        message: req.message,
        userId: req.userId
    })
});

router.get('/getuser', authTokenHandler, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return responseFunction(res, 400, 'User not found', null, false);
        }
        return responseFunction(res, 200, 'User found', user, true);

    }
    catch (err) {
        return responseFunction(res, 500, 'Internal server error', err, false);
    }
})

router.get('/test', async (req, res) => {
    // let url = await getObjectURL('hakunamatata');
    // let makankaplot = await postObjectURL('hakunamatata',"")
    res.json({
        message: 'Auth route works',
        // url: url
        // makankaplot: makankaplot
    })
})















// AWS WALA KAAAM

const getObjectURL = async (key) => {
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key
    }

    return await getSignedUrl(s3Client, new GetObjectCommand(params));
}

const postObjectURL = async (filename, contentType)=>{
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: filename,
        ContentType: contentType
    }

    return await getSignedUrl(s3Client, new PutObjectCommand(params));
}


router.get('/generatepostobjecturl', async (req, res, next)=>{
    try{
        let timeinms = new Date().getTime();

        const makankaplot = await postObjectURL(timeinms.toString(), '');


        return responseFunction(res, 200, 'S3 post Location URL generated', {
            signedUrl : makankaplot,
            filekey: timeinms.toString()
        }, true);
    }
    catch(err){
        return responseFunction(res, 500, 'Internal server error', err, false);
    }
})

router.get('/gets3urlbykey/:key', authTokenHandler, async (req, res, next)=>{
    try{
        const {key} = req.params;
        const signedUrl = await getObjectURL(key);

        if(!signedUrl){
            return responseFunction(res, 400, 'signed url not found', null, false);
        }
        return responseFunction(res, 200, 'signed url generated', {
            signedUrl: signedUrl,
        }, true);
    }
    catch(err){
        return responseFunction(res, 500, 'Internal server error', err, false);
    }
})


router.get('/logout', authTokenHandler, async (req, res, next) => {
    res.clearCookie('authToken');
    res.clearCookie('refreshToken');
    res.json({
        ok: true,
        message: 'Logged out successfully'
    })
})
module.exports = router;
