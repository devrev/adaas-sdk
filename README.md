# ADaaS Library

## Release Notes

### v1.2.5

- Add batch size option.
- Replace DevRev Typescript SDK requests with Axios for uploading and downloading artifacts.
- Remove unneccessary postState from default workers.
- Fix bugs related to attachment streaming.

### v1.2.4

- Do not fail the extraction of attachments if streaming of single attachment fails.

### v1.2.3

- Add `local` flag to use for local development of the ADaaS snap-ins.
- Send library version, snap-in version and snap-in slug in headers while emitting.
- Make `actor_id` field optional for `SsorAttachment` interface.
- Fix bugs related to event handling, error logging.

### v1.2.2

- Add library version as a part of control protocol.
- Improve axios client and adapter logging.
- Fix bugs related to state handling.

### v1.2.1

- Reduced the `delayFactor` to minimize unnecessary delays.
- Correct the setting of the `lastSyncStarted` timestamp.
- Improve logging for attachment extraction and loading.
- Fix several bugs related to the control protocol.

### v1.2.0

- Add support for loading attachments from DevRev to external system.

### v1.1.6

- Add exponential retry and handle rate-limiting towards DevRev.
- Gracefully handle failure to upload extracted attachments.

### v1.1.5

- Increase `delayFactor` and number of retries for the exponential backoff retry mechanism for HTTP requests.
- Provide an inject function for streaming attachments.
- Fix the attachments streaming bug.

### v1.1.4

- Provide log lines and stack traces for runtime worker errors.

### v1.1.3

- Export `axios` and `axiosClient` with the exponential backoff retry mechanism for HTTP requests and omit Authorization headers from Axios errors.
- Resolve circular structure logging issues.
- Fix the attachments metadata normalization bug.
- Improve repository logging.

### v1.1.2

- Unify incoming and outgoing event context.
- Add `dev_oid` to logger tags.

### v1.1.1

- Add default workers for loading deletion events.

### v1.1.0

- Support sync from DevRev to the external system. (Known limitations: no support for loading attachments.)

### v1.0.4

- Fix logging from worker threads.

### v1.0.3

- Add release notes.

### v1.0.2

- Fix bugs and improve local development.
- Expose `formatAxiosError` function for error handling.

### v1.0.1

- Fix bugs and improve logging.

### v1.0.0

- Enable extractions to use the full lambda runtime and gracefully handle execution context timeout.
- Simplify metadata and data normalization and uploading with the repo implementation.
- Provide default handling of the attachment extraction phase in the ADaaS SDK library.
- Reduce file size and streamline processes with gzip compression.
- Fix bugs and improve error handling.

### v0.0.3

- Support new recipe management.

### v0.0.2

- Support the State API.
- Provide an HTTP client for API requests.
- Create local artifact files in the local development environment.
- Improve logging.

### v0.0.1

- Implement a demo of the ADaaS snap-in.
- Add an adapter for the ADaaS control protocol with helper functions.
- Provide an uploader for uploading artifacts.

# Overview

[![Coverage Status](https://coveralls.io/repos/github/devrev/adaas-sdk/badge.svg?branch=main&t=s4Otlm)](https://coveralls.io/github/devrev/adaas-sdk?branch=main)

The ADaaS (Airdrop-as-a-Service) Library for TypeScript helps developers build Snap-ins that integrate with DevRev’s ADaaS platform. This library simplifies the workflow for handling data extraction and loading, event-driven actions, state management, and artifact handling.

It provides features such as:

- Type Definitions: Structured types for ADaaS control protocol
- Event Management: Easily emit events for different extraction or loading phases
- State Handling: Update and access state in real-time within tasks
- Artifact Management: Supports batched storage of artifacts
- Error & Timeout Support: Error handling and timeout management for long-running tasks

# Installation

```bash
npm install @devrev/ts-adaas
```
