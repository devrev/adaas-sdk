# AirSync SDK

[![Coverage Status](https://coveralls.io/repos/github/devrev/adaas-sdk/badge.svg?branch=v2&t=s4Otlm)](https://coveralls.io/github/devrev/adaas-sdk?branch=v2)

> **Note:** This is the v2 beta of the AirSync SDK (formerly Airdrop SDK). The package has been renamed from `@devrev/ts-adaas` to `@devrev/airsync-sdk`.

## Overview

The AirSync SDK for TypeScript helps developers build snap-ins that integrate with DevRev's AirSync platform. This SDK simplifies the workflow for handling data extraction and loading, event-driven actions, state management, and artifact handling.

It provides features such as:

- Type Definitions: Structured types for AirSync control protocol
- Event Management: Easily emit events for different extraction or loading phases
- State Handling: Update and access state in real-time within tasks
- Artifact Management: Supports batched storage of artifacts
- Error & Timeout Support: Error handling and timeout management for long-running tasks

## Installation

```bash
npm install @devrev/airsync-sdk@beta
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes and migration guides.

## Reference

Please refer to the [REFERENCE.md](./REFERENCE.md) file for more information on the types, interfaces and functions used in the library.
