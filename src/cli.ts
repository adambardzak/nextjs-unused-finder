#!/usr/bin/env node
import { findUnusedFiles } from './index';

findUnusedFiles().catch(console.error);