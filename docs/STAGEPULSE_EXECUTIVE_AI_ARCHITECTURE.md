# Stagepulse Executive & AI Architecture

This document defines the additive executive layer. It does not replace the existing admin, staff, offer, job, notification, APK or site flows.

## Authority hierarchy

OWNER / CEO
- Highest business authority.
- Approves strategic actions, financial thresholds and AI execution permissions.

EXECUTIVE AI / STAGEPULSE AI
- Reads approved business data.
- Combines commercial, operational, staff, equipment and financial signals.
- Produces analysis, forecasts, risks and proposals.
- Cannot override the owner.
- Critical actions require approval unless explicitly granted by the owner.

EXECUTIVE FUNCTIONS
- CEO dashboard: company-wide health, revenue, margin, workload, risks and capacity.
- Operations director: event pipeline, staffing, equipment, vehicles, schedules and incidents.
- Commercial director: leads, offers, conversion, pricing, customer value and lost opportunities.
- Finance controller: revenue, costs, receivables, payables, margin and cash-flow indicators.
- HR / people: staff categories, skills, availability, workload, training and performance history.
- Asset manager: equipment taxonomy, inventory, movement, maintenance, utilization and replacement planning.
- Marketing: campaigns, channels, landing pages, enquiries, conversion and attribution.
- Production / technical director: riders, stage plots, audio, lighting, video, rigging, power and technical readiness.

## AI agents

The central Stagepulse AI coordinates specialized agents:
- Executive AI
- Operations AI
- Sales AI
- Finance AI
- People AI
- Asset AI
- Marketing AI
- Technical Production AI
- Customer/Site AI

Agents may read and propose. Execution remains permission-controlled.

## Executive decision loop

DATA -> ANALYSIS -> RISK -> FORECAST -> OPTIONS -> OWNER APPROVAL -> EXECUTION -> RESULT -> MEMORY

## Required executive records

Future implementation should add, without altering existing flows:
- executive_goals
- executive_kpis
- strategic_initiatives
- approval_policies
- approval_requests
- budgets
- forecasts
- marketing_campaigns
- lead_sources
- customer_segments
- staff_training_records
- equipment_maintenance_plans
- supplier_records
- contracts
- business_risks
- decision_log

These records should be introduced incrementally after the current foundation is verified.
