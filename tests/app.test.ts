import { describe, expect, it, beforeAll } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import App from '../src/app/App.vue';
import { demoCard } from '../src/features/seam/model/demo';
import { validateCard } from '../src/features/seam/model/validate';
import { savePublished, toShare } from '../src/features/seam/model/store';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
});

describe('应用外壳', () => {
  it('默认打开接缝解题卡，校验与棋盘都在页面上', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('接缝解题卡');
    expect(text).toContain('全部校验通过，可发布');
    expect(wrapper.findAll('[data-check]').length).toBe(10);
    expect(wrapper.findAll('[data-testid="seam-board"] .hitbox').length).toBe(64);
    wrapper.unmount();
  });

  it('矿区对局切回后原有棋盘与目标面板仍可用', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    const playMode = wrapper.findAll('button').find(button => button.text() === '矿区对局');
    await playMode!.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="board"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="moves"]').text()).toBe('18');
    expect(wrapper.findAll('[data-testid^="objective-"]').length).toBe(2);
    wrapper.unmount();
  });

  it('打开分享链接时重建卡片并提示可复现', async () => {
    const card = demoCard();
    const witness = validateCard(card).witness.value!;
    const published = savePublished({ cards: {}, play: {} }, card, witness).cards[card.id];
    const payload = toShare(published);
    window.location.hash = `#seam=${encodeURIComponent(JSON.stringify(payload))}`;
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.text()).toContain('已从分享载荷重建解题卡');
    expect(wrapper.text()).toContain('全部校验通过，可发布');
    window.location.hash = '';
    wrapper.unmount();
  });
});
