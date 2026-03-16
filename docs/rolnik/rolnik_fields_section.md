# Rolnik / Sofa Arcade — Fields section

This document extends:

- `rolnik_design_ssot.md`

If there is a conflict, the SSOT document wins.

## Core navigation

Inside **Fields**:
- **Up / Down** = move between fields
- **Left / Right** = move between main sections (`Fields`, `Livestock`, `House`, etc.)
- **Click / Confirm** = open field action/details

This keeps the flow very simple and couch-friendly.

## Fields screen

Entering **Fields** shows a **list of owned fields**.

Each field should show only minimal info:
- field number / name
- size
- soil quality
- current or last crop
- small status icon

## Field interaction

Selecting a field opens its simple details/action state.

In valid seasons (**Spring** and **Autumn**), the field can be assigned a crop.

Main action:
- **Cultivate**

## Cultivation flow

Recommended flow:
- select field
- press **Cultivate**
- choose crop
- assign it to the field

This is better than choosing a crop first, because the player sees the exact field, its condition, and its history before making a decision.

## Automatic harvest

There is **no manual harvest action**.

Harvest happens automatically as part of the season / quarter resolution.

This avoids unnecessary clicking.

## 3-year crop plan

A field can store a **3-year crop rotation plan**.

Interaction idea:
- first click sets **Year 1** crop
- next click adds **Year 2** crop
- next click adds **Year 3** crop

This makes long-term planning simple and readable.

## Soil degradation and rotation

Fields should remember previous years.

Rules:
- **changing crops** maintains or restores soil toward its starting/base quality
- **repeating the same crop** degrades soil

This gives crop rotation real gameplay value without adding complexity.

## Crop types

Current minimal crop set:
- potatoes
- grain
- peas
- meadow

## Meadow usage

If a field is set as **Meadow**, it should not only be a crop type, but also allow a simple role choice:
- **Hay**
- **Pasture**

## Pasture rule

Recommended simplification:
- **Pasture is only for cows**

Pigs and chickens do **not** use pasture.
They depend on feed / stored resources instead.

This keeps animal roles more distinct and avoids extra system complexity.

## Summary

Final recommended Fields loop:
- enter **Fields**
- browse fields with **Up / Down**
- switch sections with **Left / Right**
- select a field
- in Spring/Autumn use **Cultivate**
- optionally build a **3-year plan**
- harvest resolves automatically
- meadows can be used as **Hay** or **Pasture**
- pasture applies to **cows only**
