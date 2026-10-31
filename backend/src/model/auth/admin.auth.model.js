import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

// Admin login credentials only. Name, avatar etc. live in AdminProfile.
const adminSchema = new mongoose.Schema({
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true, // email is optional, but must be unique when given
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'],
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
    }, // admin can block a user
    lastLoginAt: {
        type: Date
    },

    refreshToken: { type: String },

}, { timestamps: true })


adminSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
})

adminSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

adminSchema.methods.generateAccessToken = function () {
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

adminSchema.methods.generateRefreshToken = function () {
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

export const Admin = mongoose.model("Admin", adminSchema)
