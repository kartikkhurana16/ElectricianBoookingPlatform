import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

// Admin login credentials only. Name, avatar etc. live in AdminProfile.
const adminAuthSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    phoneNumber: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'],
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false
    }, // never returned by default

    adminRole: {
        type: String,
        enum: ["super_admin", "admin", "support"],
        default: "admin"
    }, // what this admin is allowed to do

    isActive: {
        type: Boolean,
        default: true
    }, // super admin can block an admin
    lastLoginAt: {
        type: Date
    },

    // 2FA
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        select: false
    },

    refreshToken: {
        type: String,
        select: false
    },

}, { timestamps: true })


adminAuthSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
})

adminAuthSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

adminAuthSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            role: "admin",
            adminRole: this.adminRole
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

adminAuthSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            role: "admin"
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const AdminAuth = mongoose.model("AdminAuth", adminAuthSchema)
