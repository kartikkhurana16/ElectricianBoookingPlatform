import mongoose from "mongoose";

// Customer profile. Login details (phone, email, password) live in auth/user.auth.model.js
const userProfileSchema = new mongoose.Schema({
    auth: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    avatar: {
        type: String
    }, // image URL
    coverImage: {
        type: String
    },

}, { timestamps: true })

export const UserProfile = mongoose.model("UserProfile", userProfileSchema)
