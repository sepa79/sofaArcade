#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from president_vsf import extract_c64mem_ram, parse_modules


MODE_LENGTHS = {
    "imp": 1,
    "acc": 1,
    "imm": 2,
    "zp": 2,
    "zpx": 2,
    "zpy": 2,
    "indx": 2,
    "indy": 2,
    "rel": 2,
    "abs": 3,
    "abx": 3,
    "aby": 3,
    "ind": 3,
}


OPCODES = {
    0x00: ("BRK", "imp"),
    0x01: ("ORA", "indx"),
    0x05: ("ORA", "zp"),
    0x06: ("ASL", "zp"),
    0x08: ("PHP", "imp"),
    0x09: ("ORA", "imm"),
    0x0A: ("ASL", "acc"),
    0x0D: ("ORA", "abs"),
    0x0E: ("ASL", "abs"),
    0x10: ("BPL", "rel"),
    0x11: ("ORA", "indy"),
    0x15: ("ORA", "zpx"),
    0x16: ("ASL", "zpx"),
    0x18: ("CLC", "imp"),
    0x19: ("ORA", "aby"),
    0x1D: ("ORA", "abx"),
    0x1E: ("ASL", "abx"),
    0x20: ("JSR", "abs"),
    0x21: ("AND", "indx"),
    0x24: ("BIT", "zp"),
    0x25: ("AND", "zp"),
    0x26: ("ROL", "zp"),
    0x28: ("PLP", "imp"),
    0x29: ("AND", "imm"),
    0x2A: ("ROL", "acc"),
    0x2C: ("BIT", "abs"),
    0x2D: ("AND", "abs"),
    0x2E: ("ROL", "abs"),
    0x30: ("BMI", "rel"),
    0x31: ("AND", "indy"),
    0x35: ("AND", "zpx"),
    0x36: ("ROL", "zpx"),
    0x38: ("SEC", "imp"),
    0x39: ("AND", "aby"),
    0x3D: ("AND", "abx"),
    0x3E: ("ROL", "abx"),
    0x40: ("RTI", "imp"),
    0x41: ("EOR", "indx"),
    0x45: ("EOR", "zp"),
    0x46: ("LSR", "zp"),
    0x48: ("PHA", "imp"),
    0x49: ("EOR", "imm"),
    0x4A: ("LSR", "acc"),
    0x4C: ("JMP", "abs"),
    0x4D: ("EOR", "abs"),
    0x4E: ("LSR", "abs"),
    0x50: ("BVC", "rel"),
    0x51: ("EOR", "indy"),
    0x55: ("EOR", "zpx"),
    0x56: ("LSR", "zpx"),
    0x58: ("CLI", "imp"),
    0x59: ("EOR", "aby"),
    0x5D: ("EOR", "abx"),
    0x5E: ("LSR", "abx"),
    0x60: ("RTS", "imp"),
    0x61: ("ADC", "indx"),
    0x65: ("ADC", "zp"),
    0x66: ("ROR", "zp"),
    0x68: ("PLA", "imp"),
    0x69: ("ADC", "imm"),
    0x6A: ("ROR", "acc"),
    0x6C: ("JMP", "ind"),
    0x6D: ("ADC", "abs"),
    0x6E: ("ROR", "abs"),
    0x70: ("BVS", "rel"),
    0x71: ("ADC", "indy"),
    0x75: ("ADC", "zpx"),
    0x76: ("ROR", "zpx"),
    0x78: ("SEI", "imp"),
    0x79: ("ADC", "aby"),
    0x7D: ("ADC", "abx"),
    0x7E: ("ROR", "abx"),
    0x81: ("STA", "indx"),
    0x84: ("STY", "zp"),
    0x85: ("STA", "zp"),
    0x86: ("STX", "zp"),
    0x88: ("DEY", "imp"),
    0x8A: ("TXA", "imp"),
    0x8C: ("STY", "abs"),
    0x8D: ("STA", "abs"),
    0x8E: ("STX", "abs"),
    0x90: ("BCC", "rel"),
    0x91: ("STA", "indy"),
    0x94: ("STY", "zpx"),
    0x95: ("STA", "zpx"),
    0x96: ("STX", "zpy"),
    0x98: ("TYA", "imp"),
    0x99: ("STA", "aby"),
    0x9A: ("TXS", "imp"),
    0x9D: ("STA", "abx"),
    0xA0: ("LDY", "imm"),
    0xA1: ("LDA", "indx"),
    0xA2: ("LDX", "imm"),
    0xA4: ("LDY", "zp"),
    0xA5: ("LDA", "zp"),
    0xA6: ("LDX", "zp"),
    0xA8: ("TAY", "imp"),
    0xA9: ("LDA", "imm"),
    0xAA: ("TAX", "imp"),
    0xAB: ("LAX", "imm"),
    0xAC: ("LDY", "abs"),
    0xAD: ("LDA", "abs"),
    0xAE: ("LDX", "abs"),
    0xB0: ("BCS", "rel"),
    0xB1: ("LDA", "indy"),
    0xB4: ("LDY", "zpx"),
    0xB5: ("LDA", "zpx"),
    0xB6: ("LDX", "zpy"),
    0xB8: ("CLV", "imp"),
    0xB9: ("LDA", "aby"),
    0xBA: ("TSX", "imp"),
    0xBC: ("LDY", "abx"),
    0xBD: ("LDA", "abx"),
    0xBE: ("LDX", "aby"),
    0xC0: ("CPY", "imm"),
    0xC1: ("CMP", "indx"),
    0xC4: ("CPY", "zp"),
    0xC5: ("CMP", "zp"),
    0xC6: ("DEC", "zp"),
    0xC8: ("INY", "imp"),
    0xC9: ("CMP", "imm"),
    0xCA: ("DEX", "imp"),
    0xCC: ("CPY", "abs"),
    0xCD: ("CMP", "abs"),
    0xCE: ("DEC", "abs"),
    0xD0: ("BNE", "rel"),
    0xD1: ("CMP", "indy"),
    0xD5: ("CMP", "zpx"),
    0xD6: ("DEC", "zpx"),
    0xD8: ("CLD", "imp"),
    0xD9: ("CMP", "aby"),
    0xDD: ("CMP", "abx"),
    0xDE: ("DEC", "abx"),
    0xE0: ("CPX", "imm"),
    0xE1: ("SBC", "indx"),
    0xE4: ("CPX", "zp"),
    0xE5: ("SBC", "zp"),
    0xE6: ("INC", "zp"),
    0xE8: ("INX", "imp"),
    0xE9: ("SBC", "imm"),
    0xEA: ("NOP", "imp"),
    0xEC: ("CPX", "abs"),
    0xED: ("SBC", "abs"),
    0xEE: ("INC", "abs"),
    0xF0: ("BEQ", "rel"),
    0xF1: ("SBC", "indy"),
    0xF5: ("SBC", "zpx"),
    0xF6: ("INC", "zpx"),
    0xF8: ("SED", "imp"),
    0xF9: ("SBC", "aby"),
    0xFD: ("SBC", "abx"),
    0xFE: ("INC", "abx"),
}


BRANCH_OPS = {"BCC", "BCS", "BEQ", "BMI", "BNE", "BPL", "BVC", "BVS"}
TERMINATORS = {"BRK", "RTI", "RTS"}


@dataclass(frozen=True)
class Instruction:
    addr: int
    opcode: int
    mnemonic: str
    mode: str
    bytes_: bytes
    operand: int | None
    target: int | None

    @property
    def size(self) -> int:
        return len(self.bytes_)


def format_operand(mode: str, operand: int | None, target: int | None) -> str:
    if mode == "imp":
        return ""
    if mode == "acc":
        return "A"
    if operand is None:
        return ""
    if mode == "imm":
        return f"#$%02x" % operand
    if mode == "zp":
        return f"$%02x" % operand
    if mode == "zpx":
        return f"$%02x,X" % operand
    if mode == "zpy":
        return f"$%02x,Y" % operand
    if mode == "indx":
        return f"($%02x,X)" % operand
    if mode == "indy":
        return f"($%02x),Y" % operand
    if mode == "abs":
        return f"$%04x" % operand
    if mode == "abx":
        return f"$%04x,X" % operand
    if mode == "aby":
        return f"$%04x,Y" % operand
    if mode == "ind":
        return f"($%04x)" % operand
    if mode == "rel":
        return f"$%04x" % target if target is not None else f"$%02x" % operand
    return f"$%02x" % operand


def decode_instruction(ram: bytes, addr: int) -> Instruction:
    opcode = ram[addr]
    if opcode not in OPCODES:
        return Instruction(addr, opcode, ".db", "imp", bytes([opcode]), None, None)

    mnemonic, mode = OPCODES[opcode]
    size = MODE_LENGTHS[mode]
    bytes_ = ram[addr : addr + size]
    operand = None
    target = None
    if size == 2:
        operand = bytes_[1]
    elif size == 3:
        operand = bytes_[1] | (bytes_[2] << 8)

    if mode == "rel" and operand is not None:
        delta = operand if operand < 0x80 else operand - 0x100
        target = (addr + size + delta) & 0xFFFF
    elif mnemonic in {"JMP", "JSR"} and mode == "abs":
        target = operand

    return Instruction(addr, opcode, mnemonic, mode, bytes_, operand, target)


def linear_disasm(ram: bytes, start: int, count: int) -> list[Instruction]:
    out: list[Instruction] = []
    pc = start
    for _ in range(count):
        ins = decode_instruction(ram, pc)
        out.append(ins)
        pc = (pc + ins.size) & 0xFFFF
    return out


def trace_disasm(ram: bytes, start: int, limit: int) -> list[Instruction]:
    queue = deque([start])
    seen: set[int] = set()
    ordered: dict[int, Instruction] = {}

    while queue and len(ordered) < limit:
        pc = queue.popleft()
        while pc not in seen and len(ordered) < limit:
            seen.add(pc)
            ins = decode_instruction(ram, pc)
            ordered[pc] = ins
            next_pc = (pc + ins.size) & 0xFFFF

            if ins.mnemonic == ".db":
                break
            if ins.mnemonic in TERMINATORS:
                break
            if ins.mnemonic == "JMP":
                if ins.mode == "abs" and ins.target is not None:
                    queue.append(ins.target)
                break
            if ins.mnemonic == "JSR":
                if ins.target is not None:
                    queue.append(ins.target)
                pc = next_pc
                continue
            if ins.mnemonic in BRANCH_OPS:
                if ins.target is not None:
                    queue.append(ins.target)
                pc = next_pc
                continue

            pc = next_pc

    return [ordered[addr] for addr in sorted(ordered)]


def print_instructions(instructions: list[Instruction]) -> None:
    for ins in instructions:
        raw = " ".join(f"{byte:02x}" for byte in ins.bytes_)
        operand = format_operand(ins.mode, ins.operand, ins.target)
        if ins.mnemonic == ".db":
            print(f"{ins.addr:04x}  {raw:<8} .db ${ins.opcode:02x}")
        elif operand:
            print(f"{ins.addr:04x}  {raw:<8} {ins.mnemonic:<4} {operand}")
        else:
            print(f"{ins.addr:04x}  {raw:<8} {ins.mnemonic}")


def load_ram(snapshot: str) -> bytes:
    path = Path(snapshot)
    data = path.read_bytes()
    return extract_c64mem_ram(data, parse_modules(data))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Disassemble 6502 code from a President VICE snapshot.")
    parser.add_argument("snapshot", help="Path to a .vsf file.")
    parser.add_argument("start", type=lambda value: int(value, 0), help="Start address, for example 0x0810.")
    parser.add_argument("--count", type=int, default=64, help="Linear mode: number of instructions to decode.")
    parser.add_argument(
        "--trace",
        action="store_true",
        help="Follow control flow recursively from the start address instead of decoding linearly.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=256,
        help="Trace mode: maximum number of instructions to emit.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    ram = load_ram(args.snapshot)

    if args.trace:
        instructions = trace_disasm(ram, args.start, args.limit)
    else:
        instructions = linear_disasm(ram, args.start, args.count)

    print_instructions(instructions)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
