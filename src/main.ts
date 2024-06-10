import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs'
import * as path from 'path'
import OpenAI from 'openai'

async function generateFormalSpecs(summary: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  core.info('Requesting formal specifications from OpenAI...')
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          'Generate formal specifications for a blockchain project based on the following summary: ' +
          summary
      }
    ],
    model: 'gpt-4o'
  })

  const messageContent = completion.choices[0].message?.content
  if (!messageContent) {
    throw new Error('Failed to generate formal specifications')
  }

  return messageContent
}

async function createOrUpdateSpecFile(specs: string): Promise<string> {
  const dirPath = path.join(process.cwd(), 'test')
  const filePath = path.join(dirPath, 'Halmos.t.sol')

  // Create test directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath)
  }

  // Write specs to the file
  fs.writeFileSync(filePath, specs, 'utf-8')
  return filePath
}

export async function run(): Promise<void> {
  try {
    const demoMode = core.getInput('demo_mode') === 'true'
    const summary = core.getInput('summary')
    let specs = ''

    if (demoMode) {
      core.info('Running in demo mode...')
      specs = `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";
import {SymTest} from "halmos-cheatcodes/SymTest.sol";

contract CounterTest is Test, SymTest {
    Counter public counter;

    function setUp() public {
        counter = new Counter();
        uint256 number = svm.createUint256("number");
        counter.setNumber(number);
    }

    function check_Increment() public {
        uint256 oldNumber = counter.number();
        counter.increment();
        assert(counter.number() == oldNumber + 1);
    }

    function check_SetNumber() public {
        uint256 updatedNumber = svm.createUint256("updatedNumber");
        counter.setNumber(updatedNumber);
        assert(counter.number() == updatedNumber);
    }
}`
    } else {
      core.info('Generating formal specifications...')
      specs = await generateFormalSpecs(summary)
    }

    core.info('Creating or updating spec file...')
    const filePath = await createOrUpdateSpecFile(specs)
    core.setOutput('file_path', filePath)
    core.info('Formal specifications generated and saved successfully.')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
