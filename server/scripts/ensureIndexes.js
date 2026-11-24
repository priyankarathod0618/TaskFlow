import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { Project } from '../src/models/Project.js';
import { Task } from '../src/models/Task.js';
import { Issue } from '../src/models/Issue.js';
import { Milestone } from '../src/models/Milestone.js';
import { TimeEntry } from '../src/models/TimeEntry.js';
import { Timesheet } from '../src/models/Timesheet.js';
import { Notification } from '../src/models/Notification.js';

const models = [User, Workspace, Project, Task, Issue, Milestone, TimeEntry, Timesheet, Notification];

try {
  await connectDatabase();
  for (const model of models) {
    await model.createIndexes();
    console.log(`Indexes ensured: ${model.modelName}`);
  }
  console.log('All declared indexes have been created or confirmed.');
} catch (error) {
  console.error('Index creation failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
