import type { NewNote } from '@/lib/db/schema'

/**
 * Sample notes seeded on first run so the home page is not empty and Ask
 * has something to retrieve. Each note has a stable `id` so reseeding is a
 * no-op (`INSERT OR IGNORE`).
 */
export const sampleNotes: Array<Omit<NewNote, 'createdAt' | 'updatedAt'> & { id: string }> = [
  {
    id: 'sample-welcome',
    title: 'ようこそ Kioku へ',
    folder: '/Welcome',
    body: `# ようこそ

Kioku はローカル保存型の Markdown ノートアプリです。書いたメモは右側のチャットパネルに質問できます。

## できること

- Markdown でメモを書く / 編集 / 削除
- 一覧をキーワード検索
- ノートに対して質問（OpenAI 経由、引用付き）

## 使い始め

1. 左上の「新規ノート」を押して 1〜2 件メモを追加
2. 右の Ask 欄に「何々について教えて」と書いて送信
3. 関連ノートから根拠付きで回答が返ります

メモは \`./kioku.db\` にローカル保存されます。
`,
  },
  {
    id: 'sample-project',
    title: 'プロジェクト方針',
    folder: '/Work',
    body: `# プロジェクト方針

## 方針

- 個人 MVP から始める。完璧より「動く・公開する」を優先。
- 品質ゲートは妥協しない: typecheck / lint / unit test / build を都度通す。
- 実機検証（ブラウザ）まで終えてから「完了」と呼ぶ。

## 次の一歩

- [ ] ノート一覧を作る
- [ ] エディタを作る
- [ ] Ask パネルでチャットを通す
`,
  },
]
