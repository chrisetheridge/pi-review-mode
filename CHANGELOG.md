# Changelog

All notable changes to this project will be documented in this file.

This project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

### Changed

### Fixed

## [0.3.1] - 2026-05-21

### Fixed

- Git-based Pi installs and updates no longer run an install-time TypeScript build with omitted dev dependencies.

## [0.3.0] - 2026-05-21

### Added

- Agent pre-review comments can now carry `spec`, `standards`, and `bug` tags, and the review UI can filter tagged comments.

## [0.2.0] - 2026-05-15

### Changed

- Agent pre-review now runs by default and can be disabled with `~/.pi/agent/extensions/pi-review-mode.json` using `{"agent-review": false}`.

## [0.1.1] - 2026-05-14

- Initial release

## [0.1.0] - 2026-05-14

### Added

- Initial Pi `/review` extension.
- Bundled native review web UI assets.
