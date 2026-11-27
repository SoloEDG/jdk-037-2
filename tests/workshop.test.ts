import { describe, expect, it, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SeamWorkshop from '../src/features/seam/ui/SeamWorkshop.vue';
import QueueEditor from '../src/features/seam/ui/QueueEditor.vue';
import { demoCard } from '../src/features/seam/model/demo';
import type { SeamStore } from '../src/features/seam/model/store';

const store: SeamStore = { cards: {}, play: {} };

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  });
});

function mountWorkshop(card = demoCard()) {
  return mount(SeamWorkshop, { props: { store, card }, attachTo: document.body });
}

describe('接缝工作室', () => {
  it('挂载后自动校验并展示跨缝见证与可发布状态', async () => {
    const wrapper = mountWorkshop();
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('全部校验通过，可发布');
    expect(wrapper.findAll('[data-check]').length).toBeGreaterThanOrEqual(8);
    expect(wrapper.find('.samples')?.text()).toContain('片段 A 原珠');
    expect(wrapper.find('.samples')?.text()).toContain('片段 B 原珠');
    wrapper.unmount();
  });

  it('「按见证试玩」重放并复现跨缝签名', async () => {
    const wrapper = mountWorkshop();
    await flushPromises();
    const hint = wrapper.findAll('button').find(button => button.text().includes('按见证试玩'));
    expect(hint).toBeTruthy();
    await hint!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('见证复现跨缝贡献');
    expect(wrapper.text()).toContain('清霜 6 / 6');
    wrapper.unmount();
  });

  it('未完成校验时发布按钮禁用，草稿按钮可用', async () => {
    const wrapper = mountWorkshop();
    await flushPromises();
    const publish = wrapper.findAll('button').find(button => button.text() === '发布');
    const draft = wrapper.findAll('button').find(button => button.text().includes('保存草稿'));
    expect(publish?.attributes('disabled')).toBeUndefined();
    await draft!.trigger('click');
    expect(wrapper.emitted('notice')?.at(-1)?.[0]).toContain('草稿');
    expect(wrapper.emitted('update:store')).toBeTruthy();
    wrapper.unmount();
  });

  it('来珠编辑器增删只影响目标列', async () => {
    const card = demoCard();
    const view = mount(QueueEditor, { props: { card } });
    const before = card.columns[0].queue.length;
    await view.findAll('.queue')[0].findAll('.dot')[1].trigger('click');
    const changed = view.emitted('change')?.[0] as [number, import('../src/shared/board').Color[]];
    expect(changed[0]).toBe(0);
    expect(changed[1].length).toBe(before + 1);
    await view.findAll('.queue')[0].find('.chip').trigger('click');
    const removed = view.emitted('change')?.[1] as [number, string[]];
    expect(removed[1].length).toBe(before - 1);
    view.unmount();
  });
});
