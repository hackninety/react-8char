import { describe, expect, it } from 'vitest';
import { decode } from '@toon-format/toon';
import type { CaseReference } from 'mingli-cases-react';
import { calculateBazi, buildExportJSON, type BaziInput } from '../src/lib/bazi';
import { buildExportMarkdown } from '../src/lib/markdown-export';
import { generateAIPrompt } from '../src/lib/prompt-template';
import { toToon } from '../src/lib/toon';
import { appendCaseReferenceMarkdown, CASE_REFERENCE_BOUNDARY, withCaseReference } from '../src/lib/case-reference';

const input: BaziInput = { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1 };
const reference: CaseReference = {
  caseId: 'test-source:case-7', title: '来源案例七', text: '原题：案例当事人的职业？\n原题答案：来源记载为教师。',
  sourceUrl: 'https://example.com/case-7', sourceRevision: 'revision-a', collectionId: 'test-source', mode: 'reference',
};

describe('独立命例参考导出', () => {
  it('默认与清除参考后保持原导出，不混入题目答案或更改出生参数', () => {
    const chart = calculateBazi(input);
    const data = buildExportJSON(input, chart);
    const before = JSON.stringify(data);
    expect(withCaseReference(data, null)).toBe(data);
    const selected = withCaseReference(data, reference);
    expect(JSON.stringify(data)).toBe(before);
    expect(selected).toHaveProperty('caseReference.caseId', reference.caseId);
    expect(withCaseReference(data, null)).not.toHaveProperty('caseReference');
    expect(input).not.toHaveProperty('caseReference');
  });

  it('TOON/Prompt 保留命盘事实和来源，并明确禁止将原案例答案移植到当前命主', () => {
    const chart = calculateBazi(input);
    const data = withCaseReference(buildExportJSON(input, chart), reference);
    const decoded = decode(toToon(data)) as Record<string, any>;
    expect(decoded.caseReference).toMatchObject({ ...reference, boundary: CASE_REFERENCE_BOUNDARY });
    const prompt = generateAIPrompt(data);
    expect(prompt).toContain('辛亥');
    expect(prompt).toContain(reference.sourceUrl);
    expect(prompt).toContain(reference.text.split('\n')[1]);
    expect(prompt).toContain('命例参考边界');
    expect(prompt).toContain('禁止将案例经历、吉凶或答案移植到当前命主');
  });

  it('Markdown 独立追加引用；未选择或清除时逐字保持原导出', () => {
    const markdown = buildExportMarkdown(input, calculateBazi(input));
    expect(appendCaseReferenceMarkdown(markdown)).toBe(markdown);
    const withReference = appendCaseReferenceMarkdown(markdown, reference);
    expect(withReference.startsWith(markdown)).toBe(true);
    expect(withReference).toContain('## 命例参考资料（非当前命主事实）');
    expect(withReference).toContain(reference.sourceRevision);
    expect(withReference).toContain(reference.text);
    expect(appendCaseReferenceMarkdown(markdown, null)).not.toContain(reference.caseId);
  });
});
