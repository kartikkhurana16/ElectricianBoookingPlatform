import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const userSchema = new mongoose.Schema({
    fullName:{
        type:String,
        required:true,
        trim:true,
        index:true
    },
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
      match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'],
    },
    password: { 
        type: String, 
        required: true, 
        minlength: 6, 
        select: false 
    }, // never returned by default
    role: {
      type: String,
      enum: ['customer', 'electrician', 'admin'],
      default: 'customer',
      index: true,
    },
    coverImage:{
        type:String
    },
    avatar: { 
        type: String 
    }, // image URL

    isPhoneVerified: { 
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
    // Password reset / OTP support
    isEmailVerified: {
        type: Boolean,
        default: false
    },

    isPhoneVerified: {
        type: Boolean,
        default: false
    },
 
    // Admin 2FA (only used when role === 'admin')
    twoFactorSecret: { type: String, select: false },

    refreshToken: { type: String },

},{timestamps:true})


userSchema.pre("save",async function () {
    if(!this.isModified("password")) return ;

    this.password = await bcrypt.hash(this.password,10);
    
})
userSchema.methods.isPasswordCorrect=async function (password) {
    return await bcrypt.compare(password,this.password)
}
userSchema.methods.generateAccessToken=function(){
    return jwt.sign(
        {
            _id:this._id,
            email:this.email,
            username:this.username,
            fullName:this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken=function(){
 return jwt.sign(
        {
            _id:this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        }
    )

}

export const User=mongoose.model("User",userSchema)
