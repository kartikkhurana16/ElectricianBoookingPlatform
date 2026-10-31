import mongoose from "mongoose";
import { randomInt } from "node:crypto";

// Services an electrician can offer. Also used by ElectricianJob.serviceType.
export const ELECTRICIAN_SKILLS = [
    "wiring",
    "switch_socket",
    "fan_installation",
    "light_fitting",
    "inverter_ups",
    "ac_installation",
    "appliance_repair",
    "mcb_db_repair",
    "earthing",
    "meter_installation",
    "cctv_installation",
    "solar_installation",
    "short_circuit_repair",
    "general_inspection",
];

export const ELECTRICIAN_LANGUAGES = ["hindi", "english", "punjabi", "bengali", "marathi", "tamil", "telugu", "gujarati", "kannada", "malayalam", "other"];

// Fields customers are allowed to see on an electrician's profile
export const ELECTRICIAN_PUBLIC_FIELDS = [
    "fullName",
    "gender",
    "avatar",
    // "bio",
    "experienceYears",
    "skills",
    "languages",
    "visitingCharge",
    "address.city",
    "address.state",
    "isAvailable",
    "verificationStatus",
    "completedJobs",
    "rating",
].join(" ");

// The profile row is created at register with only fullName.
// Everything marked requiredOnSubmit must be filled when the electrician submits the profile form.
function requiredOnSubmit() {
    return this.isProfileComplete;
}

// ID cards / KYC documents uploaded by the electrician
const idCardSchema = new mongoose.Schema({
    cardType: {
        type: String,
        enum: ["aadhaar", "pan", "voter_id", "driving_license", "electrical_license", "other"],
        required: true
    },
    cardNumber: {
        type: String,
        trim: true,
        select: false
    },
    cardImage: {
        type: String,
        required: true
    }, // image URL

    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    rejectionReason: {
        type: String
    },
    verifiedAt: {
        type: Date
    },
}, { timestamps: true });

const electricianProfileSchema = new mongoose.Schema({

    // ---------- Identity ----------
    auth: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Electrician",
        required: true,
        unique: true
    }, // phone, email, password live here

    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    gender: {
        type: String,
        enum: ["male", "female", "other"],
        required: [requiredOnSubmit, "Gender is required"]
    },
    date_of_birth: {
        type: Date,
        required: [requiredOnSubmit, "Date of birth is required"],
        validate: [
            (v) => !v || v <= new Date(new Date().setFullYear(new Date().getFullYear() - 18)),
            "Electrician must be at least 18 years old"
        ]
    },
    avatar: {
        type: String,
        required: [requiredOnSubmit, "Profile photo is required"]
    }, // image URL
    bio: {
        type: String,
        trim: true,
        maxlength: 500
    },
    languages: {
        type: [{ type: String, enum: ELECTRICIAN_LANGUAGES }],
        default: []
    },

    // ---------- Work ----------
    experienceYears: {
        type: Number,
        min: 0,
        max: 60,
        required: [requiredOnSubmit, "Experience is required"]
    },
    
    // ---------- Address ----------
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

    // ---------- Availability ----------
    // No fixed off days: the electrician switches this on/off whenever they want work.
    // Customers and admins can only assign jobs while it is true.
    isAvailable: {
        type: Boolean,
        default: false,
        index: true
    },
    availabilityUpdatedAt: {
        type: Date
    },

    // ---------- ID cards / verification ----------
    idCards: {
        type: [idCardSchema],
        default: [],
        validate: [
            function (v) { return !this.isProfileComplete || v.length > 0; },
            "Upload at least one ID card"
        ]
    },
    verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected", "suspended"],
        default: "pending",
        index: true
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin"
    },
    verifiedAt: {
        type: Date
    },

    // ---------- Profile form ----------
    isProfileComplete: {
        type: Boolean,
        default: false
    }, // true once the electrician has submitted the profile form
    profileCompletedAt: {
        type: Date
    },

    // ---------- Payment details ----------
    upiDetails: {
        type: new mongoose.Schema({
            upiId: {
                type: String,
                trim: true,
                lowercase: true,
                match: [/^[\w.-]{2,256}@[a-z]{2,64}$/, "Enter a valid UPI id"]
            },
            upiName: { type: String, trim: true }, // name registered with UPI
            qrCodeImage: { type: String }, // image URL
        }, { _id: false }),
        select: false
    }, // never returned by default

    // ---------- Earnings summary (kept in sync by ElectricianJob) ----------
    commissionPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: 15
    }, // platform cut per job
    totalEarnings: {
        type: Number,
        default: 0
    }, // lifetime money earned after commission
    pendingPayout: {
        type: Number,
        default: 0
    }, // earned but not yet paid out
    totalPaidOut: {
        type: Number,
        default: 0
    },
    totalJobs: {
        type: Number,
        default: 0
    },
    completedJobs: {
        type: Number,
        default: 0
    },

    // ---------- Rating ----------
    rating: {
        average: { type: Number, min: 0, max: 5, default: 0 },
        count: { type: Number, min: 0, default: 0 },
    },

}, { timestamps: true });

electricianProfileSchema.pre("validate", function () {
    // if (!this.electricianId) {
    //     this.electricianId = `ELE-${randomInt(100000, 1000000)}`;
    // }
    if (this.isModified("isAvailable")) {
        this.availabilityUpdatedAt = new Date();
    }
    if (this.isModified("isProfileComplete") && this.isProfileComplete && !this.profileCompletedAt) {
        this.profileCompletedAt = new Date();
    }
});

// Can a customer/admin assign a job to this electrician?
electricianProfileSchema.methods.canBeAssigned = function () {
    return this.isProfileComplete && this.isAvailable && this.verificationStatus === "verified";
};

export const ElectricianProfile = mongoose.model("ElectricianProfile", electricianProfileSchema);
