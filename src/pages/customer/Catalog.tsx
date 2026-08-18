import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Tag, Empty, Spin, Typography, Button, Input, Space } from 'antd';
import { ShoppingCartOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { itemService } from '../../services/itemService';
import { authService } from '../../services/authService';
import { priceForUser, type RecycleItem } from '../../types/database';

export default function Catalog() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await itemService.list(false);
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!keyword) return items;
    return items.filter(
      (i) => i.name.includes(keyword) || i.categories?.name?.includes(keyword)
    );
  }, [items, keyword]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>回收物品目录</Typography.Title>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索货品/分类"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate('/new-order')}>
            立即提交回收
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : filtered.length === 0 ? (
        <Empty description="暂无可回收货品" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((item) => {
            const price = priceForUser(item, user);
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                <Card
                  hoverable
                  cover={
                    <div style={{ height: 180, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ fontSize: 48, color: '#d9d9d9' }}>📦</div>
                      )}
                    </div>
                  }
                >
                  <Card.Meta
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{item.name}</span>
                        {item.categories?.name && <Tag color="green">{item.categories.name}</Tag>}
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ color: '#999', fontSize: 12, minHeight: 40 }}>
                          {item.description || '暂无描述'}
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 22, color: '#f5222d', fontWeight: 700 }}>
                            ¥{price.toFixed(2)}
                          </span>
                          <span style={{ color: '#666' }}>/ {item.unit}</span>
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
