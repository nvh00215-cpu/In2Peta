"""Versioned prompt templates.

Each module exposes VERSION plus builder functions returning chat-message lists.
Templates are plain, readable Python strings so they can be reviewed and
diffed like code. When changing a prompt meaningfully, bump its VERSION.
"""
