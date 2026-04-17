const { Schema, model}= require("mongoose");

const entrySchema = new Schema (
    {
       
        resume_text: {
        type: String,      // ← store extracted text directly
        required: true
        },

        yoe :{
            type:Number,
            required: true
        },

        target_role :{
            type:String,
            required: true
        },

        target_company :{
            type:String,
            required: true
        },    
    }
)

const Entry = model("entry",entrySchema)
module.exports = Entry 