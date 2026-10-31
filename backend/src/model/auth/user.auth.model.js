import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

// Customer login credentials only. Name, avatar etc. live in UserProfile.
const userSchema = new mongoose.Schema({
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
            phoneNumber:this.phoneNumber,
            role:"customer"
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
            role:"customer"
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        }
    )

}

// Model name kept as "User" so existing accounts in the "users" collection keep working
export const User=mongoose.model("User",userSchema)
