import mongoose from "mongoose";

// The profile row is created at register with only fullName (and designation).
// Fields marked requiredOnSubmit must be filled when the admin submits the profile form.
function requiredOnSubmit() {
    return this.isProfileComplete;
}

// Admin profile. Login details (email, password, 2FA) live in auth/admin.auth.model.js
const adminProfileSchema = new mongoose.Schema({
    auth: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    designation: {
        type: String,
        trim: true
    }, // e.g. Operations Manager
    avatar: {
        type: String
    }, // image URL
    coverImage: {
        type: String
    },
    address: {
        line1: { type: String, trim: true, required: [requiredOnSubmit, "Address line 1 is required"] },
        line2: { type: String, trim: true },
        landmark: { type: String, trim: true },
        city: { type: String, trim: true, index: true, required: [requiredOnSubmit, "City is required"] },
        state: { type: String, trim: true, required: [requiredOnSubmit, "State is required"] },
        pincode: {
            type: String,
            match: [/^\d{6}$/, "Enter a valid 6-digit pincode"],
            required: [requiredOnSubmit, "Pincode is required"]
        },
    },
    date_of_birth:{
        type:Date
    },
    isProfileComplete: {
        type: Boolean,
        default: false
    } // true once the admin has submitted the profile form
}, { timestamps: true })

export const AdminProfile = mongoose.model("AdminProfile", adminProfileSchema)
