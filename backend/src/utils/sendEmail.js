import nodemailer from "nodemailer"

const transporter=nodemailer.createTransport({
    host:process.env.SMTP_HOST,
    port:Number(process.env.SMTP_PORT) || 587,
    secure:Number(process.env.SMTP_PORT)===465,
    auth:{
        user:process.env.SMTP_USER,
        pass:process.env.SMTP_PASS
    }
})

const sendEmail=async({to,subject,text,html})=>{
    return await transporter.sendMail({
        from:process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html
    })
}

export {sendEmail}
