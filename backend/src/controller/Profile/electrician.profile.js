import { ElectricianProfile, ELECTRICIAN_PUBLIC_FIELDS } from "../../model/Profile/electricianProfile.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js"
import mongoose from "mongoose";


// Fields the electrician can fill in the profile form. Earnings, rating,
// verification etc. are never taken from the request body.
const PROFILE_FORM_FIELDS = [
    "fullName",
    "gender",
    "date_of_birth",
    "avatar",
    "bio",
    "alternatePhone",
    "languages",
    "experienceYears",
    "skills",
    "visitingCharge",
];
const ADDRESS_FIELDS = ["line1", "line2", "landmark", "city", "state", "pincode"];

// Used for both the first submit and later edits of the profile form
const saveElectricianProfile = asyncHandler(async (req, res) => {
    const body = req.body || {};

    const profile = await ElectricianProfile.findOne({ auth: req.user._id })
        .select("+upiDetails +idCards.cardNumber");

    if (!profile) {
        throw new ApiError(404, "Electrician profile not found");
    }

    PROFILE_FORM_FIELDS.forEach((field) => {
        if (body[field] !== undefined) profile.set(field, body[field]);
    });

    if (body.address && typeof body.address === "object") {
        ADDRESS_FIELDS.forEach((field) => {
            if (body.address[field] !== undefined) profile.set(`address.${field}`, body.address[field]);
        });
    }

    if (body.idCards !== undefined) {
        if (!Array.isArray(body.idCards)) {
            throw new ApiError(400, "idCards must be an array");
        }
        profile.idCards = body.idCards.map(({ cardType, cardNumber, cardImage } = {}) => ({
            cardType, cardNumber, cardImage
        }));
        // new documents have to be checked again by an admin
        profile.verificationStatus = "pending";
        profile.verifiedBy = undefined;
        profile.verifiedAt = undefined;
    }

    if (body.upiDetails && typeof body.upiDetails === "object") {
        const { upiId, upiName, qrCodeImage } = body.upiDetails;
        profile.upiDetails = { upiId, upiName, qrCodeImage };
    }

    profile.isProfileComplete = true;

    try {
        await profile.save();
    } catch (error) {
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map((e) => e.message);
            throw new ApiError(400, errors[0], errors);
        }
        throw error;
    }

    const savedProfile = await ElectricianProfile.findById(profile._id).select("+upiDetails");

    return res.status(200).json(
        new ApiResponse(200, { profile: savedProfile }, "Profile saved successfully")
    );
});

// GET /profile/:profileId  (profileId is the profile's _id)
// Customers see only the public fields of verified electricians, admins see everything
const getElectricianProfile = asyncHandler(async (req, res) => {
    const { profileId } = req.params;

    if (!mongoose.isValidObjectId(profileId)) {
        throw new ApiError(400, "Invalid profile id");
    }

    let profile;
    if (req.role === "admin") {
        profile = await ElectricianProfile.findById(profileId)
            .select("+upiDetails +idCards.cardNumber")
            .populate("auth", "phoneNumber email isActive isPhoneVerified isEmailVerified lastLoginAt createdAt");
    } else {
        profile = await ElectricianProfile.findOne({
            _id: profileId,
            isProfileComplete: true,
            verificationStatus: "verified"
        }).select(ELECTRICIAN_PUBLIC_FIELDS);
    }

    if (!profile) {
        throw new ApiError(404, "Electrician not found");
    }

    return res.status(200).json(
        new ApiResponse(200, { profile }, "Electrician profile fetched successfully")
    );
});


export {
    saveElectricianProfile,
    getElectricianProfile,
};
