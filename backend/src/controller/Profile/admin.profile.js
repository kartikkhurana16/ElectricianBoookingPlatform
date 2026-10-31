import asyncHandler from "../../utils/asyncHandler.js";
import { AdminProfile } from "../../model/Profile/adminProfile.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const PROFILE_FORM_FIELDS=[
    "fullName",
    "designation",
    "avatar",
    "coverImage",
    "date_of_birth"
];

const ADDRESS_FIELDS = ["line1", "line2", "landmark", "city", "state", "pincode"];

const saveAdminProfile= asyncHandler(async(req,res)=>{
    const body=req.body || {};

    const profile = await AdminProfile.findOne({ auth: req.user._id })

    if(!profile){
        throw new ApiError(404,"profile not found")
    }

    PROFILE_FORM_FIELDS.forEach((field)=>{
        if(body[field]!==undefined){
            profile.set(field,body[field]);
        }
    });
    if(body.address && typeof body.address==="object"){
        ADDRESS_FIELDS.forEach((field)=>{
            if(body.address[field]!== undefined){
                profile.set(`address.${field}`,body.address[field])
            }
        });
    }

    profile.isProfileComplete = true;

    try {
        await profile.save();
    } catch (error) {
        if(error.name=="ValidationError"){
            const errors=Object.values(error.errors).map((e)=>e.message);
            throw new ApiError(400, errors[0], errors);
        }
        throw error;
    }
    const savedProfile=await AdminProfile.findById(profile._id);

    return res.status(200).json(
            new ApiResponse(200,{profile:savedProfile},"profile saved success fully")
    )

})

export {
    saveAdminProfile
}
