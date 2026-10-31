import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

// Login credentials only. Profile details live in ElectricianProfile.
const electricianAuthSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: [true, 'Phone is required'],
        unique: true,
        trim: true,
        match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'],
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        unique: true,
        sparse: true, // email is optional, but must be unique when given
        match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    }, // never returned by default

    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }, // admin can block login
    lastLoginAt: {
        type: Date
    },
    refreshToken: {
        type: String,
        select: false
    },

}, { timestamps: true })


electricianAuthSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
})

electricianAuthSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

electricianAuthSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            phoneNumber: this.phoneNumber,
            email: this.email,
            role: "electrician"
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

electricianAuthSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            role: "electrician"
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const Electrician = mongoose.model("Electrician", electricianAuthSchema)
