# Skill: Resource & Structural Optimization

## 役割
Javaの言語特性（Set, Singleton, Static）を最大限活用し、コード量とメモリ使用量を最小化する。

## 実行プロセス
1. **重複排除（Set活用）**: リスト内の重複データ処理に対し、ArrayListではなくHashSet/TreeSetを適切に選択し、ロジックを簡素化する。
2. **リソース集約（Singleton/Static）**: DB接続や設定管理など、システムで一意であるべき要素にSingletonパターンを適用し、不要なインスタンス生成を抑制する。
3. **共通定数・ユーティリティ（Static活用）**: 散在する定数や共通処理をstaticメンバ/メソッドとして集約し、コードの重複（DRY原則）を排除する。
