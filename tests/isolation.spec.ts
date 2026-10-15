/**
 * Isolation guard spec — the outer check that the test suite can never touch the
 * developer's real `$DSH_HOME`.
 *
 * Motivation: a previous revision set the isolated `DSH_HOME` from a `beforeAll` hook,
 * which runs *after* test files are collected. A spec that captured the entry value at
 * describe scope and restored it in `afterEach` therefore put the real home back, and a
 * later suite wrote `~/.dsh/ops-manager/config.json`. This spec pins the invariant so any
 * such regression fails loudly instead of silently corrupting a workstation.
 */
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import { ConfigStore } from '../src/config-store.js'

const realConfigPath = os.homedir() + '/.dsh/ops-manager/config.json'

describe('测试隔离不变量', () => {
  it('DSH_HOME 必须是指定的隔离目录，且不得等于真实主目录', () => {
    const dshHome = process.env.DSH_HOME
    expect(dshHome, 'DSH_HOME 必须被 setup 设置').toBeTruthy()
    // 精确匹配 setup 创建的目录名，而不是「任意临时目录」——否则一个外部传入的
    // 哨兵 DSH_HOME（例如开发者自己的临时目录）也会被误判为已隔离。
    expect(
      dshHome!.includes('growth-studio-test-home-'),
      `DSH_HOME 必须来自 tests/setup-isolation.ts，实际为 ${dshHome}`,
    ).toBe(true)
    expect(dshHome).not.toBe(os.homedir() + '/.dsh')
  })

  it('写出配置的测试不得改写真实宿主配置（完整套件的外层哨兵）', async () => {
    const before = fs.existsSync(realConfigPath) ? fs.readFileSync(realConfigPath, 'utf-8') : null

    // 故意走最危险的路径：ctx 为 undefined → resolveDshHome 会回退到 DSH_HOME
    const store = new ConfigStore(undefined, { draftsDir: '/tmp/__must_not_leak__' })
    await store.save({ draftsDir: '/tmp/__must_not_leak__' })

    // 写入必须落在隔离目录内
    const isolatedConfig = `${process.env.DSH_HOME}/ops-manager/config.json`
    expect(fs.existsSync(isolatedConfig)).toBe(true)
    expect(JSON.parse(fs.readFileSync(isolatedConfig, 'utf-8')).draftsDir).toBe('/tmp/__must_not_leak__')

    // 真实配置必须逐字节不变（包括「原本不存在」的情形）
    const after = fs.existsSync(realConfigPath) ? fs.readFileSync(realConfigPath, 'utf-8') : null
    expect(after).toBe(before)
    if (before !== null) {
      expect(JSON.parse(before).draftsDir).not.toBe('/tmp/__must_not_leak__')
    }
  })
})
