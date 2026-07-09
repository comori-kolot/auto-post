# greeen-biz-ai-automation

[greeen-biz.com](https://greeen-biz.com/) 向けのSEO記事自動生成・自動投稿パイプライン。
ChatGPT（OpenAI API）で記事本文とアイキャッチ画像を生成し、WordPress REST APIで投稿する。
GitHub Actionsで週1回自動実行する。

## 仕組み

1. `data/keywords.csv` から未使用（`status=unused`）のキーワードを1件取得
2. OpenAI Chat Completions（`scripts/generate-article.mjs`）でタイトル・meta description・本文HTMLを生成
3. OpenAI Images API（`scripts/generate-image.mjs`）でアイキャッチ画像を生成
4. WordPress REST API（`scripts/publish-to-wp.mjs`）で画像アップロード＋記事を`publish`状態で投稿
5. 該当キーワードを`used`に更新し、投稿URLとともに`data/keywords.csv`へコミット

**公開は完全自動・即公開（レビューなし）**。キーワードや記事内容を事前に確認したい場合は、`data/keywords.csv`を編集して対象行を`unused`のままにしておく／削除することで実行をスキップできる。

## セットアップ

### 1. OpenAI APIキーを発行する

1. https://platform.openai.com/api-keys でAPIキーを新規発行
2. 画像生成（`gpt-image-1`）を使うには組織のOrganization verificationが必要な場合がある

### 2. WordPressのアプリケーションパスワードを発行する

1. https://greeen-biz.com/wp-admin/profile.php にログイン
2. 「アプリケーションパスワード」セクションで新しいパスワード名（例: `github-actions`）を入力し発行
3. 表示されたパスワード（スペース区切りの文字列）をコピー（一度しか表示されない）

### 3. GitHub Secretsに登録する

リポジトリの Settings → Secrets and variables → Actions → New repository secret で以下を登録:

| Secret名 | 値 |
| --- | --- |
| `OPENAI_API_KEY` | 手順1で発行したキー |
| `WP_URL` | `https://greeen-biz.com` |
| `WP_USERNAME` | `kousuke.kff@gmail.com`（またはWPの管理者ユーザー名） |
| `WP_APP_PASSWORD` | 手順2で発行したアプリケーションパスワード |

### 4. 動作確認

GitHubリポジトリの Actions タブ → `Publish Article` → `Run workflow` で手動実行し、
`data/keywords.csv`の1行が`used`に更新され、`https://greeen-biz.com/`に新しい記事が公開されることを確認する。

## ローカルでのテスト実行

```bash
npm install
cp .env.example .env  # 値を埋める
node --env-file=.env scripts/run.mjs
```

## キーワードの追加・管理

`data/keywords.csv`に行を追加すれば次回実行時に消費される。列構成:

```
keyword,volume,difficulty,cpc_jpy,status,added_at,published_url
```

- `status`: `unused` / `used`
- `volume`/`difficulty`/`cpc_jpy`: Ahrefs等のSEOツールで調査した参考値（任意）
- `published_url`: 投稿後に自動で記入される

未使用キーワードが尽きるとワークフローは失敗して通知される。定期的にキーワードリストを補充すること。
