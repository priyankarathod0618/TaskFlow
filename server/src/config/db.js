import mongoose from 'mongoose';

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in server/.env');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 12000,
    autoIndex: process.env.NODE_ENV !== 'production'
  });

  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
