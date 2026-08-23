# oss-licensing Specification

## Purpose

CarpinteroPro is open-source software. The licensing model governs who can fork, modify, redistribute, and host the software, and what obligations those who run a hosted service owe back to the community. This spec captures the licensing contract as code: the LICENSE file, the copyright header, the README disclosure, and the rationale for the chosen license.

The license chosen is the GNU Affero General Public License v3.0 (AGPL-3.0). AGPL-3.0 was selected over MIT to ensure that any modified deployment of CarpinteroPro served over the network must publish its source modifications — keeping the hosted-SaaS version of the project open-source rather than allowing proprietary forks to capture value without contributing back.

## Requirements

### Requirement: AGPL-3.0 LICENSE file is present at the repository root

A canonical `LICENSE` file MUST exist at the repository root, containing the verbatim GNU AGPL-3.0 text and a copyright header.

#### Scenario: LICENSE file presence verified

- GIVEN the repository at any commit
- WHEN a contributor or tooling checks for `LICENSE` at the repo root
- THEN the file exists and is non-empty

#### Scenario: LICENSE body is the canonical GNU AGPL-3.0 text

- GIVEN the `LICENSE` file
- WHEN reading the body
- THEN the text matches the verbatim GNU AGPL-3.0 (preserved title preamble, "TERMS AND CONDITIONS" sections, and the FSF's copyright notice as part of the body — those are part of the canonical text)

#### Scenario: Copyright header names the maintainer and year

- GIVEN the `LICENSE` file
- WHEN reading the first line
- THEN it follows the form `Copyright (C) <year> <holder name>`
- AND the holder name matches a stable identifier for the long-term maintainer (e.g., a real person or a stable organization name, not a placeholder)

### Requirement: Copyright year matches the release calendar year

- GIVEN a `LICENSE` file with a copyright header from year `Y`
- WHEN the repository is published or re-released in calendar year `Y'`
- THEN the copyright year in `LICENSE` MUST match the calendar year of the publication

#### Scenario: First publication of v0.1.0-beta.1

- GIVEN the `LICENSE` was committed during the v0.2.0-beta.1 OSS prep in 2026
- WHEN reviewing the file
- THEN the header reads `Copyright (C) 2026 <holder>`

### Requirement: README exposes the license visibly to forkers

The README MUST carry an AGPL-3.0 badge near the top and a License section that links to `LICENSE` with a plain-language summary of the SaaS-copyleft obligation.

#### Scenario: README badge points to AGPL-3.0

- GIVEN the README on `main` after the v0.2.0-beta.1 release
- WHEN a contributor reads the README header
- THEN the first non-title line is a shields.io badge with target `https://www.gnu.org/licenses/agpl-3.0` and label `License: AGPL-3.0`

#### Scenario: README License section is present and explains the obligation

- GIVEN the README
- WHEN a forker reads the License section
- THEN they find a heading (typically `## License`)
- AND the section contains a link to `LICENSE`
- AND the section contains a 1–3 sentence plain-language summary stating that anyone running a modified version as a network service must publish their modifications

### Requirement: SaaS copyleft rationale is preserved

Where the README License section lives, the chosen license (AGPL-3.0 over MIT) MUST be justifiable in plain language so a forker understands the intent.

#### Scenario: License rationale survives rewrites

- GIVEN a fork that rewrites the README
- WHEN the fork keeps the AGPL-3.0 LICENSE file unchanged
- THEN the rewritten README MAY add additional commentary but SHOULD NOT contradict the SaaS-copyleft intent (e.g., SHOULD NOT claim the project is under MIT or that AGPL-3.0 is permissive)

### Requirement: AGPL-3.0 is detected by GitHub's license picker

- GIVEN the repository on GitHub
- WHEN GitHub's API queries `/repos/{owner}/{repo}/license`
- THEN the response includes `spdx_id: AGPL-3.0` (proving the license picker reads the canonical file)

#### Scenario: AGPL-3.0 autodetected on `main`

- GIVEN `main` at the state right after `v0.2.0-beta.1` was tagged
- WHEN the GitHub license picker processes the repo
- THEN it reads `LICENSE`, recognises AGPL-3.0, and exposes the badge accordingly

## Notes

- The LICENSE file body is verbatim GNU canonical text by design (no paraphrasing). Any modification of the legal language is a security/legal matter and SHOULD go through a deliberate license-change process, not a code change.
- The release pipeline (`release-pipeline`) spec covers versioning and release artefacts; this spec covers the licensing decision specifically.
- This spec establishes the **contract**, not the implementation. Future changes that affect licensing (e.g., license upgrade) MUST update this file via the standard SDD flow.
