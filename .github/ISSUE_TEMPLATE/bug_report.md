---
name: Bug report
description: Report a bug or unexpected behavior
title: "[Bug] "
labels: bug
body:
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: Describe the issue clearly.
      placeholder: What happened?
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: List the steps to reproduce the issue.
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
  - type: textarea
    id: environment
    attributes:
      label: Environment
