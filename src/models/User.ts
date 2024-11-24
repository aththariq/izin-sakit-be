import { Schema, model, Document } from "mongoose";

interface IUser extends Document {
  googleId?: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  username?: string;
  password?: string;
}

const UserSchema = new Schema<IUser>({
  googleId: { type: String },
  displayName: { type: String },
  email: { type: String, unique: true }, // Ensure email is unique
  avatar: { type: String },
  username: { type: String, unique: true },
  password: { type: String },
});

export default model<IUser>("User", UserSchema);
