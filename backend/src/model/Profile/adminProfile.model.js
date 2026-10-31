import mongoose from "mongoose";

// Admin profile. Login details (email, password, 2FA) live in auth/admin.auth.model.js
const adminProfileSchema = new mongoose.Schema({
    auth: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdminAuth",
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    avatar: {
        type: String
    }, // image URL
    designation: {
        type: String,
        trim: true
    },

}, { timestamps: true })

export const AdminProfile = mongoose.model("AdminProfile", adminProfileSchema)
