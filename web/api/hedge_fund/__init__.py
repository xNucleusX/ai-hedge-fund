"""AI Hedge Fund v2 — quantitative trading stack.

A clean-room rebuild focused on quant fundamentals:
data pipelines, event studies, backtesting, validation,
feature engineering, portfolio construction, risk management,
and execution simulation.

VENDORED COPY — this tree is a trimmed mirror of /hedge_fund at the repo
root (data, brokers, fund, risk, pipeline, portfolio, signals, llm,
features only; no backtesting/event_study/tui/validation), kept here so
api/run.py is self-contained within Vercel's project Root Directory
(web/). It exists purely to dodge scipy/matplotlib/textual, which the
full package pulls in for features this endpoint never uses, and which
would blow the serverless function size budget. Source of truth for the
engine is the root hedge_fund/ package — port changes there over by hand
when they touch a module listed above.
"""
